// Score & high scores: per-level bests persisted in localStorage (same
// try/catch fallback pattern as progress.js — works headless and on file://).

const SCORES_KEY = 'towerDefenseScores.v1';

// Score = kills × 10 + lives × 50 + moneyEarned × 1.
const SCORE_WEIGHTS = { kills: 10, lives: 50, money: 1 };

function computeScore({ kills = 0, lives = 0, moneyEarned = 0 } = {}) {
  return Math.max(0, Math.round(
    kills * SCORE_WEIGHTS.kills +
    lives * SCORE_WEIGHTS.lives +
    moneyEarned * SCORE_WEIGHTS.money
  ));
}

function loadScores() {
  let data = null;
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (err) { /* no storage available — start fresh */ }
  return normalizeScores(data);
}

function saveScores(s) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(s));
  } catch (err) { /* non-persistent session; in-memory copy still works */ }
}

// Shape: { best: { "<levelIndex>": <number>, ... } } — per-level best scores.
function normalizeScores(data) {
  const best = {};
  if (data && typeof data.best === 'object' && data.best) {
    for (const [k, v] of Object.entries(data.best)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && Number.isFinite(v) && v > 0) {
        best[i] = Math.floor(v);
      }
    }
  }
  return { best };
}

// Record a score for a level; returns the (possibly new) best for that level.
// Persists only when the new score beats the stored best.
function recordScore(levelIndex, score) {
  const s = loadScores();
  const i = Math.max(0, levelIndex | 0);
  const prev = s.best[i] || 0;
  const val = Math.max(0, Math.floor(score));
  if (val > prev) {
    s.best[i] = val;
    saveScores(s);
    return val;
  }
  return prev;
}

// Best score for a level (0 if none recorded).
function bestScore(levelIndex) {
  const i = Math.max(0, levelIndex | 0);
  return loadScores().best[i] || 0;
}
