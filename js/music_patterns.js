// Phase 46: music pattern data + builders (pure — no AudioContext, so it is
// fully testable headless). js/music.js schedules what this module builds.
//
// Two loops:
// - `normal`: an 8-bar (128 sixteenth-step) loop in A minor with real chords
//   (pad + arpeggio voices), a per-bar bass pattern, and an 8-eighth melody
//   that develops over the loop (motif → sequence → cadence answer → climax
//   → resolution). Two 4-bar phrases: A = Am–F–C–G (I–VI–III–VII),
//   B = Am–G–F–E (i–VII–VI–V — the E major is a dominant cadence into the
//   loop restart, which is why the loop never sounds like it just repeats).
// - `boss`: a 4-bar (64-step) loop in A minor (Am–Am–F–E): driving eighth
//   square bass, off-beat power-chord stabs on the F/E bars, a simple
//   call-and-response melody, kick on every beat + a bar-3 fill, hats on the
//   off-eighths + an extra 16th into bar 4.
//
// Step grid: 16 sixteenth-note steps per bar. Voices are per-step arrays of
// length `steps`: bass[i] = {freq,type,dur,peak} | null; arp[i] = array of
// frequencies (chord tones sounding together) | null; lead[i] = {freq,dur,
// peak} | null; kick[i]/hat[i]/snare[i] = boolean.

// --- note helpers -----------------------------------------------------------

// MIDI note number → frequency (A4 = 69 = 440 Hz).
function NOTE(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// Triads as MIDI arrays (root position, around the A3–E5 area).
const CHORDS = {
  Am: [57, 60, 64],   // A3 C4 E4
  F:  [53, 57, 60],   // F3 A3 C4
  C:  [48, 52, 55, 60], // C3 E3 G3 C4 (root is low; pad transposes up)
  G:  [55, 59, 62],   // G3 B3 D4
  E:  [52, 56, 59],   // E3 G#3 B3
};

// Bass roots (MIDI) per normal-mode bar — one per bar of the 8-bar loop.
const NORMAL_BASS_ROOTS = [45, 41, 48, 43, 45, 43, 41, 40]; // A2 F2 C3 G2 A2 G2 F2 E2

// Bass patterns: 8 eighth-note slots (steps 0,2,4,...,14). Each entry is a
// multiplier of the bar's root frequency: 1 = root, 2 = octave up, 1.5 =
// fifth, 'next' = pickup to the NEXT bar's root (only valid in the last slot).
const BASS_PATTERNS = {
  roots:  [1, null, 1, null, 1, null, 1, null],
  bounce: [1, null, 2, null, 1, null, 2, null],
  fifth:  [1, null, 1.5, null, 1, null, 1.5, null],
  walk:   [1, null, 1.5, null, 2, null, 1, 'next'],
};

// Arp patterns: 8 eighth-note slots; each entry is an index into the bar's
// chord-tone array (see below). `null` = rest.
const ARP_PATTERNS = {
  up:    [0, 1, 2, 3, 0, 1, 2, 3],
  down:  [3, 2, 1, 0, 3, 2, 1, 0],
  triad: [0, 1, 2, 0, 1, 2, 0, 1],
  pulse: [0, 1, 0, 1, 2, 1, 2, 1],
};

// The 8 normal-mode bars. `chord` = CHORDS key; `bass`/`arp` = pattern keys;
// `melody` = 8 eighth-note slots of MIDI numbers (null = rest); `fill` = the
// arp voice drops out on this bar so the melody can close the loop.
const NORMAL_BARS = [
  // Phrase A: Am – F – C – G
  { chord: 'Am', bass: 'roots',  arp: 'up',    fill: false,
    melody: [69, null, 72, null, 76, null, 74, null] },          // motif: A4–C5–E5
  { chord: 'F',  bass: 'bounce', arp: 'triad', fill: false,
    melody: [72, null, 69, null, 67, null, 65, null] },          // answer down the F chord
  { chord: 'C',  bass: 'fifth',  arp: 'down',  fill: false,
    melody: [74, null, 76, null, 79, null, 77, null] },          // sequence up a step (C)
  { chord: 'G',  bass: 'walk',   arp: 'pulse', fill: false,
    melody: [76, null, 74, null, 71, null, 69, null] },          // walk home to A
  // Phrase B: Am – G – F – E (dominant cadence)
  { chord: 'Am', bass: 'roots',  arp: 'triad', fill: false,
    melody: [72, null, 74, null, 76, null, 74, null] },          // motif reprise
  { chord: 'G',  bass: 'bounce', arp: 'pulse', fill: false,
    melody: [79, null, 77, null, 74, null, 71, null] },          // reach up (B4) then fall
  { chord: 'F',  bass: 'fifth',  arp: 'down',  fill: false,
    melody: [72, null, 74, null, 76, null, 79, null] },          // build to the climax
  { chord: 'E',  bass: 'walk',   arp: 'up',    fill: true,
    melody: [81, null, 79, null, 76, null, 74, 72] },            // climax E5 → resolve to A4
];

// The 4 boss-mode bars (Am – Am – F – E).
const BOSS_BARS = [
  { chord: 'Am', bass: 45, stab: false,
    melody: [69, null, 72, null, 76, null, 72, null] },
  { chord: 'Am', bass: 45, stab: true,
    melody: [null, null, null, null, null, null, null, null] },
  { chord: 'F',  bass: 41, stab: false,
    melody: [65, null, 69, null, 72, null, 69, null] },
  { chord: 'E',  bass: 40, stab: true,
    melody: [null, null, null, null, null, null, null, null] },
];

// --- builders ----------------------------------------------------------------

function midiToFreq(m) { return NOTE(m); }

// Build one pattern object: { stepDur, steps, bass[], arp[], lead[], kick[],
// hat[], snare[] }. `bpm` is quarter-note BPM; steps = bars * 16 sixteenths.
function buildPattern(bpm, bars, opts) {
  const stepDur = 60 / bpm / 4;
  const steps = bars.length * 16;
  const pat = { stepDur, steps, bass: [], arp: [], lead: [], kick: [], hat: [], snare: [] };
  for (let i = 0; i < steps; i++) {
    pat.bass[i] = null; pat.arp[i] = null; pat.lead[i] = null;
    pat.kick[i] = false; pat.hat[i] = false; pat.snare[i] = false;
  }
  bars.forEach((bar, b) => {
    for (let s = 0; s < 16; s++) {
      const i = b * 16 + s;
      if (s % 2 !== 0) continue; // voices sit on eighth-note slots
      const slot = s / 2;
      const bassPat = opts.bassPattern ? opts.bassPattern(bar) : null;
      const bassMul = bassPat ? bassPat[slot] : null;
      if (bassMul != null) {
        let freq;
        if (bassMul === 'next') freq = midiToFreq(opts.nextRoot(b, slot));
        else freq = midiToFreq(opts.rootMidi(b)) * bassMul;
        pat.bass[i] = { freq, type: opts.bassType, dur: stepDur * 1.8, peak: opts.bassPeak };
      }
      const arpPat = opts.arpPattern ? opts.arpPattern(bar) : null;
      const arpIdx = arpPat ? arpPat[slot] : null;
      if (arpIdx != null && !bar.fill) {
        const tones = opts.chordTones(bar);
        pat.arp[i] = [tones[arpIdx]];
      }
      const m = opts.melody(bar)[slot];
      if (m != null) {
        pat.lead[i] = { freq: midiToFreq(m), dur: stepDur * 1.7, peak: opts.leadPeak };
      }
    }
    // Per-bar percussion (opts.percussion may be absent → all false). The
    // setter is called as set(stepIndex, { kick?, hat?, snare? }).
    if (opts.percussion) opts.percussion(bar, b, (step, flags) => {
      const i = b * 16 + step;
      if (flags.kick) pat.kick[i] = true;
      if (flags.hat) pat.hat[i] = true;
      if (flags.snare) pat.snare[i] = true;
    });
  });
  return pat;
}

// Normal mode: 8 bars @ 108 BPM. The pad voice (one chord per bar) is derived
// by the engine from `chordTones` — it reads NORMAL_BARS directly, so no
// extra field here.
const PATTERNS_NORMAL = buildPattern(108, NORMAL_BARS, {
  rootMidi: b => NORMAL_BASS_ROOTS[b],
  nextRoot: (b) => NORMAL_BASS_ROOTS[(b + 1) % NORMAL_BARS.length],
  bassPattern: bar => BASS_PATTERNS[bar.bass],
  arpPattern: bar => ARP_PATTERNS[bar.arp],
  chordTones: bar => CHORDS[bar.chord].map(midiToFreq),
  melody: bar => bar.melody,
  bassType: 'triangle', bassPeak: 0.30, leadPeak: 0.14,
  // No percussion in normal mode — the calm voice is pad + bass + arp + lead;
  // the drums belong to the boss mode (the contrast is the point).
});

// Boss mode: 4 bars @ 132 BPM — kick on every beat + a bar-3 fill, hats on the
// off-eighths (+ an extra 16th into bar 4), snare on beats 2 & 4, off-beat
// power-chord stabs (root + fifth) on the marked bars.
const PATTERNS_BOSS = buildPattern(132, BOSS_BARS, {
  rootMidi: b => BOSS_BARS[b].bass,
  bassPattern: bar => [1, null, 1, 2, 1, null, 1, 2], // driving eighths w/ octave accents
  arpPattern: bar => (bar.stab ? [0, null, 1, null, 0, null, 1, null] : null), // root+fifth stabs
  chordTones: bar => [NOTE(bar.bass + 12), NOTE(bar.bass + 19)], // power chord: root + fifth
  melody: bar => bar.melody,
  bassType: 'square', bassPeak: 0.16, leadPeak: 0.13,
  percussion: (bar, b, set) => {
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) set(s, { kick: true });
      if (b === 2 && s >= 8) set(s, { kick: true });         // bar-3 fill: extra kicks
      if (s % 4 === 2) set(s, { hat: true });                // off-eighth hats
      if (b === 3 && s === 14) set(s, { hat: true });        // extra 16th into bar 4
      if (s === 4 || s === 12) set(s, { snare: true });      // beats 2 & 4
    }
  },
});

// Public: the two finished patterns (same shape the old PATTERNS constant had,
// plus lead[] and snare[]).
const PATTERNS = { normal: PATTERNS_NORMAL, boss: PATTERNS_BOSS };

// The pad voice needs per-bar chord tones + the bar layout; expose them so
// music.js can schedule one chord per bar without re-deriving anything.
const NORMAL_BAR_DATA = NORMAL_BARS.map((bar, b) => ({
  tones: CHORDS[bar.chord].map(midiToFreq),
  rootMidi: NORMAL_BASS_ROOTS[b],
}));
