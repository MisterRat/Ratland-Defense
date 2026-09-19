// Phase 52: all-time (of all time) stats persisted in localStorage — the same
// try/catch + normalize pattern as score.js, so it works headless and on file://.
// The store is cached in memory after first load; a level's stats are folded
// in ONCE at level end (win OR loss — main.js's status transition), levelsWon
// increments on victory, and the Reset button on the bottom bar clears it.
// The bar shows the stored totals as-is (not live-updated); a level that ends
// without a win/loss transition (e.g. a crash mid-level) simply never folds.

const TOTAL_STATS_KEY = 'towerDefenseTotalStats.v1';

// The complete field set — normalize keeps only these, so a corrupt store can
// never grow junk keys or non-numeric values.
const TOTAL_STAT_FIELDS = [
  'kills', 'moneyEarned', 'wavesSurvived', 'damageDealt',
  'towersBuilt', 'towersSold', 'towersDestroyed', 'leaked', 'dotKills', 'directKills', 'levelsWon',
];

function emptyTotalStats() {
  const t = {};
  for (const f of TOTAL_STAT_FIELDS) t[f] = 0;
  return t;
}

// The live cache — loaded once from storage, then mutated in memory and
// persisted on fold/reset (never re-parsed per frame).
let _totalCache = null;

function loadTotalStats() {
  let data = null;
  try {
    const raw = localStorage.getItem(TOTAL_STATS_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (err) { /* no storage available — start fresh */ }
  return normalizeTotalStats(data);
}

function saveTotalStats(t) {
  try { localStorage.setItem(TOTAL_STATS_KEY, JSON.stringify(t)); }
  catch (err) { /* non-persistent session; in-memory copy still works */ }
}

// Shape: a flat object of non-negative integers, one per TOTAL_STAT_FIELDS key.
function normalizeTotalStats(data) {
  const t = emptyTotalStats();
  if (data && typeof data === 'object') {
    for (const f of TOTAL_STAT_FIELDS) {
      const v = data[f];
      if (Number.isFinite(v) && v >= 0) t[f] = Math.floor(v);
    }
  }
  return t;
}

// The cached all-time store (loaded on first access).
function getTotalStats() {
  if (_totalCache === null) _totalCache = loadTotalStats();
  return _totalCache;
}

// Fold one level's stats object into the all-time store and persist it.
// damageDealt is rounded (it accumulates fractional post-resistance damage).
// won=true also counts the victory (levelsWon) — a loss folds the same stats
// without a win credit.
function foldTotalStats(s, won) {
  const t = getTotalStats();
  if (s && typeof s === 'object') {
    for (const f of TOTAL_STAT_FIELDS) {
      if (f === 'levelsWon') continue; // counted only via `won`
      if (Number.isFinite(s[f]) && s[f] > 0) t[f] += (f === 'damageDealt') ? Math.round(s[f]) : Math.floor(s[f]);
    }
  }
  if (won) t.levelsWon++;
  saveTotalStats(t);
  return t;
}

// Clear the all-time history and persist the zeros.
function resetTotalStats() {
  _totalCache = emptyTotalStats();
  saveTotalStats(_totalCache);
  return _totalCache;
}
