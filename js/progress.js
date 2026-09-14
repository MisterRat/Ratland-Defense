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

// Custom levels (localStorage store, js/level_custom.js) are ALWAYS unlocked —
// they come after the built-ins in the registry and sit outside the win-to-
// unlock gate. Counted from the store at boot; 0 when level_custom.js isn't
// loaded (smoke bundles without it).
function customCount() {
  return typeof getCustomLevels === 'function' ? getCustomLevels().length : 0;
}

// Shape: { unlocked: <number of levels playable>, beatenAll: boolean }
function normalizeProgress(data) {
  // Registry (levelCount) when loaded; LEVELS fallback keeps progress.js usable
  // in smoke bundles that don't include the registry.
  const n = typeof levelCount === 'function' ? levelCount() : LEVELS.length;
  // Floor = built-ins + custom: a fresh player can already play every
  // custom level (they are appended after the built-ins). Only built-in
  // levels past the floor stay locked.
  const floor = (typeof LEVELS !== 'undefined' ? LEVELS.length : 1) + customCount();
  let unlocked = data && Number.isInteger(data.unlocked) ? data.unlocked : floor;
  unlocked = Math.max(floor, Math.min(n, unlocked));
  return { unlocked, beatenAll: !!(data && data.beatenAll) };
}
