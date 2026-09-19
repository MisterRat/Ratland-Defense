// Phase 60: real audio files replace the synthesized chiptunes. This is the
// static roster — pure data, no AudioContext, so it is testable headless.
// js/music.js plays these via HTMLAudioElement (file:// safe: <audio> loads
// local files without fetch/XHR, and loops natively).
//
// Normal-mode tracks: one is picked uniformly at random on each Start (never
// the same song twice in a row — same rule as the old synthesized roster).
// The boss track plays while a Colossus is on screen; when it leaves, the
// normal track resumes from where it was.

const MUSIC_SONGS = [
  { name: 'Ashes & Armor',       src: 'assets/music/Ashes_&_Armor.ogg' },
  { name: 'Desperate Perimeter', src: 'assets/music/Desperate_Perimeter.ogg' },
  { name: 'Frontline Engagement',src: 'assets/music/Frontline_Engagement.ogg' },
  { name: 'Iron & Anvil',        src: 'assets/music/Iron_&_Anvil.ogg' },
  { name: 'Mud & Iron',          src: 'assets/music/Mud_&_Iron.ogg' },
  { name: 'Silent Advance',      src: 'assets/music/Silent_Advance.ogg' },
  { name: 'Stained Victory',     src: 'assets/music/Stained_Victory.ogg' },
  { name: 'Tactical Recon',      src: 'assets/music/Tactical_Recon.ogg' },
  { name: 'Wall Breakers',       src: 'assets/music/Wall_Breakers.ogg' },
];

// Boss track (Colossus on screen).
const BOSS_MUSIC_SRC = 'assets/music/boss.ogg';
