// SFX engine: owns the AudioContext (created lazily on first user gesture to
// satisfy browser autoplay policy) and plays the generated sound recipes from
// js/sfx_sounds.js. Headless-safe: if AudioContext is unavailable (node smoke
// tests), play() is a silent no-op. Mute state persists via localStorage.

const MUTE_KEY = 'towerDefenseMuted.v1';

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (err) { return false; }
}

function saveMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (err) { /* no storage */ }
}

const SFX = {
  ctx: null,       // AudioContext, created on demand
  master: null,    // master gain node (all sounds route through it)
  muted: loadMuted(),

  // Create the context + master gain. Called from a user gesture so the
  // browser allows audio; safe to call repeatedly.
  ensure() {
    if (this.ctx) return this.ctx;
    const w = typeof window !== 'undefined' ? window : null;
    const AC = w && (w.AudioContext || w.webkitAudioContext);
    if (!AC) return null; // headless / unsupported: stay silent
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  // Play a sound by name (see SOUNDS in js/sfx_sounds.js). No-op when muted,
  // unknown, or when no AudioContext exists.
  play(name) {
    if (this.muted) return;
    const recipe = SOUNDS[name];
    if (!recipe) return;
    const ctx = this.ensure();
    if (!ctx) return;
    recipe(ctx, this.master, ctx.currentTime);
  },

  // Toggle mute; returns the new muted state. Persists the choice.
  toggleMute() {
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  },

  // Set mute explicitly (used by the HUD button to reflect persisted state).
  setMuted(muted) {
    this.muted = !!muted;
    saveMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  },
};
