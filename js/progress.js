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

// Shape: { unlocked: <number of levels playable>, beatenAll: boolean }
function normalizeProgress(data) {
  // Registry (levelCount) when loaded; LEVELS fallback keeps progress.js usable
  // in smoke bundles that don't include the registry.
  const n = typeof levelCount === 'function' ? levelCount() : LEVELS.length;
  let unlocked = data && Number.isInteger(data.unlocked) ? data.unlocked : 1;
  unlocked = Math.max(1, Math.min(n, unlocked));
  return { unlocked, beatenAll: !!(data && data.beatenAll) };
}
