// Persistent progression: which levels are unlocked, and whether the game has
// been fully beaten. Survives reloads via localStorage when available (file://
// in most browsers); falls back to in-memory state otherwise.

const PROGRESS_KEY = 'towerDefenseProgress.v1';

function loadProgress() {
  let data = null;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (err) { /* no storage available — start fresh */ }
  return normalizeProgress(data);
}

function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (err) { /* non-persistent session; in-memory copy still works */ }
}

// External levels (js/levels_external.js) are ALWAYS unlocked — they come
// after the built-ins in the registry and sit outside the win-to-unlock
// gate. EXTERNAL_COUNT is emitted by tools/build_levels.mjs; 0 when the
// generated file isn't loaded (smoke bundles, levelgen page).
function externalCount() {
  return typeof EXTERNAL_COUNT === 'number' ? EXTERNAL_COUNT : 0;
}

// Shape: { unlocked: <number of levels playable>, beatenAll: boolean }
function normalizeProgress(data) {
  // Registry (levelCount) when loaded; LEVELS fallback keeps progress.js usable
  // in smoke bundles that don't include the registry.
  const n = typeof levelCount === 'function' ? levelCount() : LEVELS.length;
  // Floor = built-ins + externals: a fresh player can already play every
  // external level (they are appended after the built-ins, ordered by
  // difficulty then name). Only built-in levels past the floor stay locked.
  const floor = (typeof LEVELS !== 'undefined' ? LEVELS.length : 1) + externalCount();
  let unlocked = data && Number.isInteger(data.unlocked) ? data.unlocked : floor;
  unlocked = Math.max(floor, Math.min(n, unlocked));
  return { unlocked, beatenAll: !!(data && data.beatenAll) };
}
