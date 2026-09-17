// Phase 48: five more normal-mode songs + the NORMAL_SONGS roster.
// Pure data + builders — no AudioContext (testable headless). Reuses NOTE,
// CHORDS, BASS_PATTERNS, ARP_PATTERNS, buildPattern, midiToFreq and the
// original NORMAL_BARS/NORMAL_BASS_ROOTS from js/music_patterns.js (which must
// load first).
//
// The engine (js/music.js) picks one song uniformly at random in Music.start()
// and plays NORMAL_SONGS[Music.songIndex()] in normal mode. Every song is an
// 8-bar (128-step) loop ending on a dominant-cadence bar (V), so the loop
// restart never sounds like a plain repeat. Bars use the same shape as
// NORMAL_BARS: { chord, bassRoot, bass, arp, melody, fill? }.

// Build one finished song: per-step pattern + per-bar pad data.
function buildSong(song) {
  const bars = song.bars;
  const pattern = buildPattern(song.bpm, bars, {
    rootMidi: b => bars[b].bassRoot,
    nextRoot: b => bars[(b + 1) % bars.length].bassRoot,
    bassPattern: bar => BASS_PATTERNS[bar.bass],
    arpPattern: bar => ARP_PATTERNS[bar.arp],
    chordTones: bar => CHORDS[bar.chord].map(midiToFreq),
    melody: bar => bar.melody,
    bassType: 'triangle', bassPeak: 0.30, leadPeak: 0.14,
    percussion: song.percussion || null,
  });
  return Object.assign({}, song, {
    pattern,
    barData: bars.map(bar => ({
      tones: CHORDS[bar.chord].map(midiToFreq),
      rootMidi: bar.bassRoot,
    })),
  });
}

// Song 1 — "Home": the original Phase-46 A-minor loop (Am–F–C–G | Am–G–F–E).
const SONG_HOME = buildSong({
  name: 'Home', bpm: 108,
  bars: NORMAL_BARS.map((bar, b) => Object.assign({}, bar, { bassRoot: NORMAL_BASS_ROOTS[b] })),
});

// Song 2 — "Meadow": bright C major (C–G–Am–F | C–Am–F–G), 116 BPM.
const SONG_MEADOW = buildSong({
  name: 'Meadow', bpm: 116,
  bars: [
    { chord: 'C',  bassRoot: 48, bass: 'bounce', arp: 'up',    fill: false,
      melody: [72, null, 76, null, 79, null, 76, null] },
    { chord: 'G',  bassRoot: 43, bass: 'roots',  arp: 'triad', fill: false,
      melody: [79, null, 78, null, 74, null, 71, null] },
    { chord: 'Am', bassRoot: 45, bass: 'fifth',  arp: 'down',  fill: false,
      melody: [72, null, 76, null, 79, null, 81, null] },
    { chord: 'F',  bassRoot: 41, bass: 'walk',   arp: 'pulse', fill: false,
      melody: [81, null, 79, null, 77, null, 74, null] },
    { chord: 'C',  bassRoot: 48, bass: 'roots',  arp: 'up',    fill: false,
      melody: [72, null, 74, null, 76, null, 79, null] },
    { chord: 'Am', bassRoot: 45, bass: 'fifth',  arp: 'triad', fill: false,
      melody: [81, null, 79, null, 76, null, 74, null] },
    { chord: 'F',  bassRoot: 41, bass: 'bounce', arp: 'down',  fill: false,
      melody: [72, null, 74, null, 77, null, 79, null] },
    { chord: 'G',  bassRoot: 43, bass: 'walk',   arp: 'pulse', fill: true,
      melody: [83, null, 79, null, 76, null, 74, 71] },
  ],
});

// Song 3 — "Twilight": mellow D minor (Dm–Bb–F–C | Dm–C–F–A), 96 BPM.
const SONG_TWILIGHT = buildSong({
  name: 'Twilight', bpm: 96,
  bars: [
    { chord: 'Dm', bassRoot: 50, bass: 'roots',  arp: 'triad', fill: false,
      melody: [74, null, null, null, 72, null, null, 70] },
    { chord: 'Bb', bassRoot: 46, bass: 'fifth',  arp: 'down',  fill: false,
      melody: [69, null, null, null, 71, null, null, null] },
    { chord: 'F',  bassRoot: 41, bass: 'bounce', arp: 'triad', fill: false,
      melody: [72, null, 74, null, 77, null, null, null] },
    { chord: 'C',  bassRoot: 48, bass: 'walk',   arp: 'pulse', fill: false,
      melody: [74, null, null, null, 72, null, 70, null] },
    { chord: 'Dm', bassRoot: 50, bass: 'roots',  arp: 'triad', fill: false,
      melody: [78, null, null, null, 74, null, null, null] },
    { chord: 'C',  bassRoot: 48, bass: 'fifth',  arp: 'down',  fill: false,
      melody: [72, null, 74, null, 76, null, null, null] },
    { chord: 'F',  bassRoot: 41, bass: 'bounce', arp: 'up',    fill: false,
      melody: [77, null, 79, null, 81, null, null, null] },
    { chord: 'A',  bassRoot: 45, bass: 'walk',   arp: 'triad', fill: true,
      melody: [83, null, 81, null, 79, null, 76, 74] },
  ],
});

// Song 4 — "Ratland": playful A minor (Am–G–Em–F | Am–Em–F–E), 124 BPM.
const SONG_RATLAND = buildSong({
  name: 'Ratland', bpm: 124,
  bars: [
    { chord: 'Am', bassRoot: 45, bass: 'bounce', arp: 'pulse', fill: false,
      melody: [69, 72, 69, 74, 69, 72, 69, null] },
    { chord: 'G',  bassRoot: 43, bass: 'roots',  arp: 'up',    fill: false,
      melody: [74, 71, 74, 76, 74, 71, 74, null] },
    { chord: 'Em', bassRoot: 40, bass: 'bounce', arp: 'triad', fill: false,
      melody: [76, 74, 76, 79, 76, 74, 76, null] },
    { chord: 'F',  bassRoot: 41, bass: 'fifth',  arp: 'down',  fill: false,
      melody: [77, 74, 72, 74, 72, 70, 72, null] },
    { chord: 'Am', bassRoot: 45, bass: 'bounce', arp: 'pulse', fill: false,
      melody: [69, 72, 74, 76, 74, 72, 74, null] },
    { chord: 'Em', bassRoot: 40, bass: 'fifth',  arp: 'up',    fill: false,
      melody: [79, 76, 74, 76, 74, 72, 74, null] },
    { chord: 'F',  bassRoot: 41, bass: 'bounce', arp: 'down',  fill: false,
      melody: [72, 74, 77, 79, 77, 74, 77, null] },
    { chord: 'E',  bassRoot: 40, bass: 'walk',   arp: 'up',    fill: true,
      melody: [81, 79, 76, 74, 76, 74, 72, 69] },
  ],
});

// Song 5 — "Ember": warm E minor (Em–C–G–D | Em–G–D–B), 104 BPM.
const SONG_EMBER = buildSong({
  name: 'Ember', bpm: 104,
  bars: [
    { chord: 'Em', bassRoot: 40, bass: 'roots',  arp: 'triad', fill: false,
      melody: [76, null, 79, null, 83, null, 79, null] },
    { chord: 'C',  bassRoot: 48, bass: 'bounce', arp: 'up',    fill: false,
      melody: [76, null, 74, null, 72, null, 74, null] },
    { chord: 'G',  bassRoot: 43, bass: 'fifth',  arp: 'down',  fill: false,
      melody: [71, null, 74, null, 79, null, 74, null] },
    { chord: 'D',  bassRoot: 50, bass: 'walk',   arp: 'pulse', fill: false,
      melody: [76, null, 79, null, 81, null, 79, null] },
    { chord: 'Em', bassRoot: 40, bass: 'roots',  arp: 'triad', fill: false,
      melody: [76, null, 79, null, 83, null, 84, null] },
    { chord: 'G',  bassRoot: 43, bass: 'fifth',  arp: 'up',    fill: false,
      melody: [83, null, 79, null, 76, null, 74, null] },
    { chord: 'D',  bassRoot: 50, bass: 'bounce', arp: 'down',  fill: false,
      melody: [76, null, 79, null, 81, null, 84, null] },
    { chord: 'B',  bassRoot: 47, bass: 'walk',   arp: 'up',    fill: true,
      melody: [86, null, 84, null, 81, null, 79, 76] },
  ],
});

// Song 6 — "Stormfront": driving A minor (Am–F–Am–G | Am–Em–C–E), 128 BPM,
// with light percussion (kick on beats 1 & 3, hats on the off-eighths).
const SONG_STORMFRONT = buildSong({
  name: 'Stormfront', bpm: 128,
  percussion: (bar, b, set) => {
    for (let s = 0; s < 16; s++) {
      if (s === 0 || s === 8) set(s, { kick: true });   // beats 1 & 3
      if (s % 4 === 2) set(s, { hat: true });           // off-eighth hats
    }
  },
  bars: [
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'pulse', fill: false,
      melody: [69, null, 69, null, 72, null, 74, null] },
    { chord: 'F',  bassRoot: 41, bass: 'drive', arp: 'triad', fill: false,
      melody: [77, null, 77, null, 74, null, 72, null] },
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'pulse', fill: false,
      melody: [69, null, 72, null, 69, null, 72, null] },
    { chord: 'G',  bassRoot: 43, bass: 'drive', arp: 'down',  fill: false,
      melody: [79, null, 79, null, 76, null, 74, null] },
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'up',    fill: false,
      melody: [81, null, 81, null, 79, null, 76, null] },
    { chord: 'Em', bassRoot: 40, bass: 'drive', arp: 'triad', fill: false,
      melody: [74, null, 76, null, 79, null, 81, null] },
    { chord: 'C',  bassRoot: 48, bass: 'drive', arp: 'down',  fill: false,
      melody: [72, null, 74, null, 76, null, 79, null] },
    { chord: 'E',  bassRoot: 40, bass: 'drive', arp: 'up',    fill: true,
      melody: [81, null, 79, null, 76, null, 74, 72] },
  ],
});

// Song 7 — "Neon Drift": energetic synthwave (Am–Fmaj7–C–G | Am–F–Dm–E), 120 BPM.
const SONG_NEON_DRIFT = buildSong({
  name: 'Neon Drift', bpm: 120,
  percussion: (bar, b, set) => {
    for (let s = 0; s < 16; s++) {
      if (s === 0 || s === 8) set(s, { kick: true });
      if (s === 4 || s === 12) set(s, { snare: true });
      if (s % 2 === 1) set(s, { hat: true }); // driving 16th hats
    }
  },
  bars: [
    // Phrase A: Am – F – C – G
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'up', fill: false,
      melody: [69, 72, null, 76, 74, null, 72, 69] },
    { chord: 'F',  bassRoot: 41, bass: 'drive', arp: 'pulse', fill: false,
      melody: [72, 76, null, 79, 77, null, 76, 72] },
    { chord: 'C',  bassRoot: 48, bass: 'bounce', arp: 'down', fill: false,
      melody: [76, 79, null, 81, 79, null, 76, 74] },
    { chord: 'G',  bassRoot: 43, bass: 'walk', arp: 'triad', fill: false,
      melody: [74, 76, null, 74, 71, null, 69, 67] },
    // Phrase B: Am – F – Dm – E (Dominant Cadence)
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'up', fill: false,
      melody: [69, 72, null, 76, 79, null, 81, null] },
    { chord: 'F',  bassRoot: 41, bass: 'drive', arp: 'pulse', fill: false,
      melody: [81, 79, null, 77, 76, null, 74, 72] },
    { chord: 'Dm', bassRoot: 50, bass: 'fifth', arp: 'down', fill: false,
      melody: [74, 77, null, 81, 83, null, 81, 79] },
    { chord: 'E',  bassRoot: 40, bass: 'walk', arp: 'up', fill: true,
      melody: [83, 81, 79, 76, 74, 72, 71, 68] },
    ],
});

// Song 8 — "Obsidian Ruins": slow moody dungeon synth (Am–Dm–Bb–Am | F–Dm–Bb–E), 92 BPM.
const SONG_OBSIDIAN = buildSong({
  name: 'Obsidian Ruins', bpm: 92,
  bars: [
    // Phrase A: Am – Dm – Bb – Am
    { chord: 'Am', bassRoot: 45, bass: 'roots', arp: 'triad', fill: false,
      melody: [69, null, null, 72, 76, null, null, 74] },
    { chord: 'Dm', bassRoot: 50, bass: 'fifth', arp: 'down', fill: false,
      melody: [72, null, null, 70, 69, null, null, 67] },
    { chord: 'Bb', bassRoot: 46, bass: 'bounce', arp: 'pulse', fill: false,
      melody: [70, null, null, 74, 77, null, null, 75] },
    { chord: 'Am', bassRoot: 45, bass: 'walk', arp: 'triad', fill: false,
      melody: [74, null, null, 72, 69, null, null, null] },
    // Phrase B: F – Dm – Bb – E
    { chord: 'F',  bassRoot: 41, bass: 'roots', arp: 'up', fill: false,
      melody: [77, null, null, 81, 80, null, null, 77] },
    { chord: 'Dm', bassRoot: 50, bass: 'fifth', arp: 'down', fill: false,
      melody: [77, null, null, 74, 72, null, null, 70] },
    { chord: 'Bb', bassRoot: 46, bass: 'bounce', arp: 'pulse', fill: false,
      melody: [70, null, null, 74, 77, null, 79, null] },
    { chord: 'E',  bassRoot: 40, bass: 'walk', arp: 'up', fill: true,
      melody: [80, null, 79, null, 76, 74, 71, 68] },
  ],
});

// Song 9 — "Skyline Run": high-speed arcade chiptune (C–Am–F–G | C–Em–F–G), 136 BPM.
// Uses dual-note harmony in the lead array for a 2-voice lead synth effect.
const SONG_SKYLINE = buildSong({
  name: 'Skyline Run', bpm: 136,
  percussion: (bar, b, set) => {
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) set(s, { kick: true });
      if (s === 4 || s === 12) set(s, { snare: true });
      if (s % 2 === 0) set(s, { hat: true });
    }
  },
  bars: [
    { chord: 'C',  bassRoot: 48, bass: 'drive', arp: 'up', fill: false,
      melody: [72, 76, 79, 76, 81, 79, 76, 72] },
    { chord: 'Am', bassRoot: 45, bass: 'drive', arp: 'triad', fill: false,
      melody: [72, 76, 81, 76, 84, 81, 76, 72] },
    { chord: 'F',  bassRoot: 41, bass: 'drive', arp: 'pulse', fill: false,
      melody: [77, 81, 84, 81, 86, 84, 81, 77] },
    { chord: 'G',  bassRoot: 43, bass: 'walk',  arp: 'down', fill: false,
      melody: [79, 83, 86, 83, 84, 83, 79, 74] },
    { chord: 'C',  bassRoot: 48, bass: 'drive', arp: 'up', fill: false,
      melody: [84, null, 81, 79, 84, null, 81, 79] },
    { chord: 'Em', bassRoot: 40, bass: 'fifth', arp: 'triad', fill: false,
      melody: [83, null, 79, 76, 83, null, 79, 76] },
    { chord: 'F',  bassRoot: 41, bass: 'drive', arp: 'down', fill: false,
      melody: [81, null, 77, 74, 81, null, 84, null] },
    { chord: 'G',  bassRoot: 43, bass: 'walk',  arp: 'pulse', fill: true,
      melody: [86, 84, 83, 79, 76, 74, 71, 67] },
  ],
});

// Song 10 — "Astral Temple": JRPG mystical theme (Am–A–Dm–F | Am–C–D–E), 100 BPM.
const SONG_ASTRAL = buildSong({
  name: 'Astral Temple', bpm: 100,
  bars: [
    { chord: 'Am', bassRoot: 45, bass: 'roots',  arp: 'triad', fill: false,
      melody: [69, null, 72, null, 76, 77, 76, null] },
    { chord: 'A',  bassRoot: 45, bass: 'fifth',  arp: 'up',    fill: false,
      melody: [73, null, 76, null, 81, 80, 81, null] },
    { chord: 'Dm', bassRoot: 50, bass: 'bounce', arp: 'down',  fill: false,
      melody: [74, null, 77, null, 81, 82, 81, null] },
    { chord: 'F',  bassRoot: 41, bass: 'walk',   arp: 'pulse', fill: false,
      melody: [77, null, 74, null, 72, 70, 69, null] },
    { chord: 'Am', bassRoot: 45, bass: 'roots',  arp: 'triad', fill: false,
      melody: [72, null, 76, null, 79, 81, 83, null] },
    { chord: 'C',  bassRoot: 48, bass: 'fifth',  arp: 'up',    fill: false,
      melody: [84, null, 81, null, 79, 76, 74, null] },
    { chord: 'D',  bassRoot: 50, bass: 'bounce', arp: 'down',  fill: false,
      melody: [78, null, 81, null, 83, null, 86, null] },
    { chord: 'E',  bassRoot: 40, bass: 'walk',   arp: 'triad', fill: true,
      melody: [88, 86, 83, 79, 76, 74, 71, 68] },
  ],
});

// Song 11 — "Clockwork Citadel": intricate puzzle theme (Em–B–C–G | Em–Am–D–B), 112 BPM.
const SONG_CLOCKWORK = buildSong({
  name: 'Clockwork Citadel', bpm: 112,
  percussion: (bar, b, set) => {
    for (let s = 0; s < 16; s++) {
      if (s === 2 || s === 10) set(s, { hat: true }); // syncopated off-beat clock hats
      if (s === 8) set(s, { snare: true });
    }
  },
  bars: [
    { chord: 'Em', bassRoot: 40, bass: 'bounce', arp: 'triad', fill: false,
      melody: [76, 76, null, 79, 76, 76, null, 83] },
    { chord: 'B',  bassRoot: 47, bass: 'roots',  arp: 'triad', fill: false,
      melody: [75, 75, null, 78, 75, 75, null, 81] },
    { chord: 'C',  bassRoot: 48, bass: 'fifth',  arp: 'triad', fill: false,
      melody: [72, 72, null, 76, 72, 72, null, 79] },
    { chord: 'G',  bassRoot: 43, bass: 'walk',   arp: 'triad', fill: false,
      melody: [71, 71, null, 74, 71, 71, null, 74] },
    { chord: 'Em', bassRoot: 40, bass: 'bounce', arp: 'triad', fill: false,
      melody: [76, null, 79, null, 83, null, 86, null] },
    { chord: 'Am', bassRoot: 45, bass: 'fifth',  arp: 'triad', fill: false,
      melody: [88, null, 85, null, 81, null, 77, null] },
    { chord: 'D',  bassRoot: 50, bass: 'bounce', arp: 'triad', fill: false,
      melody: [86, null, 83, null, 79, null, 78, null] },
    { chord: 'B',  bassRoot: 47, bass: 'walk',   arp: 'up',    fill: true,
      melody: [83, 81, 78, 75, 74, 71, 68, 65] },
  ],
});


// Public: the full 11-song normal-mode roster
const NORMAL_SONGS = [
  SONG_HOME, 
  SONG_MEADOW, 
  SONG_TWILIGHT, 
  SONG_RATLAND,
  SONG_EMBER, 
  SONG_STORMFRONT,
  SONG_NEON_DRIFT,
  SONG_OBSIDIAN,
  SONG_SKYLINE,
  SONG_ASTRAL,
  SONG_CLOCKWORK
];
