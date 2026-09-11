// Sound recipes for the SFX engine. Each recipe is a function
// (ctx, out, when) => ... that schedules Web Audio nodes: oscillators and
// white-noise bursts shaped by gain envelopes. Everything is generated at
// play time — no external files, so file:// keeps working.
//
// `out` is the master gain node; `when` is the ctx.currentTime offset (in
// seconds) at which the sound should start.

// --- low-level helpers ----------------------------------------------------

// One oscillator: type/freq start values, optional frequency ramp to
// freqEnd over dur, and a linear gain envelope peak -> 0 over dur.
function tone(ctx, out, when, { type = 'sine', freq = 440, freqEnd = null,
  dur = 0.1, peak = 0.2 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + dur);
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

// White-noise burst: `dur` seconds of noise through a biquad filter
// (type/freq), gain envelope peak -> 0.
function noise(ctx, out, when, { dur = 0.1, peak = 0.3, type = 'lowpass', freq = 1000 }) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f).connect(g).connect(out);
  src.start(when);
  src.stop(when + dur);
}

// --- tower fire sounds ----------------------------------------------------

// Gun: short high "pew" — a fast downward square blip.
function sfxPew(ctx, out, when) {
  tone(ctx, out, when, { type: 'square', freq: 880, freqEnd: 220, dur: 0.09, peak: 0.12 });
}

// Cannon: "boom" — low sine thump plus a short noise burst.
function sfxBoom(ctx, out, when) {
  tone(ctx, out, when, { type: 'sine', freq: 150, freqEnd: 40, dur: 0.3, peak: 0.5 });
  noise(ctx, out, when, { dur: 0.15, peak: 0.25, type: 'lowpass', freq: 500 });
}

// Sniper: "crack" — a sharp highpass noise snap plus a tiny high click.
function sfxCrack(ctx, out, when) {
  noise(ctx, out, when, { dur: 0.06, peak: 0.4, type: 'highpass', freq: 2500 });
  tone(ctx, out, when, { type: 'square', freq: 2200, freqEnd: 900, dur: 0.04, peak: 0.15 });
}

// Railgun: "zip" — a fast rising sawtooth sweep (energy charge + release).
function sfxZip(ctx, out, when) {
  tone(ctx, out, when, { type: 'sawtooth', freq: 300, freqEnd: 2400, dur: 0.18, peak: 0.18 });
  tone(ctx, out, when + 0.16, { type: 'square', freq: 1800, freqEnd: 500, dur: 0.07, peak: 0.12 });
}

// Frost: "whoosh" — a bandpass noise swell with a soft high shimmer.
function sfxWhoosh(ctx, out, when) {
  noise(ctx, out, when, { dur: 0.3, peak: 0.22, type: 'bandpass', freq: 900 });
  tone(ctx, out, when, { type: 'sine', freq: 1400, freqEnd: 2600, dur: 0.25, peak: 0.06 });
}

// Flame: "sizzle" — a longer highpass noise hiss with a faint low rumble.
function sfxSizzle(ctx, out, when) {
  noise(ctx, out, when, { dur: 0.4, peak: 0.18, type: 'highpass', freq: 3500 });
  tone(ctx, out, when, { type: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.3, peak: 0.08 });
}

// --- game event sounds ----------------------------------------------------

// Enemy death: "pop" — a quick rising sine blip with a tiny click.
function sfxPop(ctx, out, when) {
  tone(ctx, out, when, { type: 'sine', freq: 300, freqEnd: 900, dur: 0.08, peak: 0.25 });
  tone(ctx, out, when, { type: 'square', freq: 1200, freqEnd: 400, dur: 0.03, peak: 0.08 });
}

// Enemy leaked: "thud" — a dull low thump (sine drop + muffled noise).
function sfxThud(ctx, out, when) {
  tone(ctx, out, when, { type: 'sine', freq: 120, freqEnd: 50, dur: 0.25, peak: 0.45 });
  noise(ctx, out, when, { dur: 0.12, peak: 0.15, type: 'lowpass', freq: 300 });
}

// Wave start: "horn" — a two-note brass-ish sawtooth call (A3 → E4).
function sfxHorn(ctx, out, when) {
  tone(ctx, out, when, { type: 'sawtooth', freq: 220, dur: 0.18, peak: 0.2 });
  tone(ctx, out, when + 0.18, { type: 'sawtooth', freq: 330, dur: 0.35, peak: 0.22 });
}

// Victory: fanfare — a short C-E-G-C arpeggio (triangle for a bright timbre).
function sfxFanfare(ctx, out, when) {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(ctx, out, when + i * 0.15, { type: 'triangle', freq: f, dur: 0.3, peak: 0.2 }));
}

// Defeat: sting — a descending minor fall (E4 → C4 → G3), slow and dark.
function sfxSting(ctx, out, when) {
  const notes = [329.63, 261.63, 196.0]; // E4 C4 G3
  notes.forEach((f, i) => tone(ctx, out, when + i * 0.25, { type: 'sawtooth', freq: f, freqEnd: f * 0.98, dur: 0.4, peak: 0.18 }));
}

// --- registries -----------------------------------------------------------

// Every sound name → recipe. The engine (js/sfx.js) looks these up.
const SOUNDS = {
  pew: sfxPew, boom: sfxBoom, crack: sfxCrack, zip: sfxZip,
  whoosh: sfxWhoosh, sizzle: sfxSizzle,
  pop: sfxPop, thud: sfxThud, horn: sfxHorn,
  fanfare: sfxFanfare, sting: sfxSting,
};

// Tower type key → fire sound name (used by the game's tower loop).
const FIRE_SOUND = {
  basic: 'pew', cannon: 'boom', sniper: 'crack',
  railgun: 'zip', frost: 'whoosh', flame: 'sizzle',
};

